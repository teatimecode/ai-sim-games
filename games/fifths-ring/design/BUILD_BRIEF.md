# BUILD_BRIEF — 实现约定

## 技术形态

静态页面，三个文件：`index.html`、`styles.css`、`game.js`。原生 JavaScript，无框架、无构建、无 CDN、无网络请求。音频用 Web Audio 现场合成。状态存 `localStorage`，键为 `wuduhuan-v1`。

## 数据模型

```text
district = { id, name, char, who, desc, angle }
room = {
  id, district, kind, title, meta, char, line,
  teach: { title, body[], quote, cite },
  ...按 kind 附加的载荷
}
kind: counterpoint | scale | harmony | set | pop | form | locked
level = { id, title, cpSide, species, cantus[], palette[], spell, reference[], attribution, source }
```

房间载荷：`counterpoint` 指向 `LEVELS` 的索引；`scale` 带目标音级集合与主音；`harmony` 带若干局面，每个局面有上一和弦与三个候选；`set` 带成员音级与移调量；`pop` 带循环与起始位置。

持久状态：`cp`、`scale`、`harmony`、`set`、`pop` 各自按房间 id 存进度，另有 `cleared`、`seals`、`signed`。

## 判定引擎

全部为纯函数，不接触 DOM 与音频，可在 node 内复算：

| 函数 | 用途 |
|---|---|
| `judge(level, slots)` | 对位十七條硬规则 |
| `harmonyIssues(prev, next, tonicPc)` | 功能退回、导音解决、七音解决 |
| `orderFrom(members, start)` / `minSpanOf` | 正常序与最小跨度 |
| `commonTonesOf(a, b)` / `sameSet` | 共同音与集合相等 |
| `formJudge(room, st)` | 曲式：段落标签、结构点小节、分界集合 |

## 音频

每次操作都发声。放置发纵向音响，续和声发整和弦，拼音阶与测音集发整组音，曲式房间逐小节合成和声加旋律并有播放头。音色为基频加二三次谐波的柔和持续音，附一个程序生成的短混响。首个用户手势后才创建 `AudioContext`。

## 输入

鼠标点击环节点、账页选项、谱位与音高候选。对位房支持键盘：`1`–`9` 选音高、`←` `→` 移动谱位、`Backspace` 清空、`Enter` 听当前纵向音响、`空格` 听固定旋律。`Esc` 关闭讲解卡与结算页。

## 架构分层

`game.js` 按节组织：音高工具 → 对位关卡数据 → 对位判定 → 音频 → 谱面渲染 → 世界数据 → 状态 → 新判定 → 环渲染 → 地图视图 → 房间视图 → 讲解与结算 → 启动。第 1–6 节沿用第一轮已验证的代码，未改动判定逻辑。

## 验收

`qa/verification.json` 六项基础验收：`launch`、`render`、`input`、`coreLoop`、`outcome`、`restart`，另加 `worldChecks` 覆盖讲解卡、结局、曲式与对位回归。

内容与规则自检为 `tests/check.js`，`node tests/check.js` 一条命令跑完，覆盖房间与教程卡完整性、对位四关可解性、和声局面合法性、音集与曲式数据的一致性。

## 已知取舍

- 谱面用 SVG 自绘，不支持连音线等排版细节；对位练习全是全音符，视觉上足够辨认。
- 环上节点的音名用一张固定拼写表，覆盖本作三个拼音阶房间用到的调。若以后加需要异名同音重拼的调，例如 F♯ 大调的 E♯，会显示成等音写法；当前没有这样的房间。
- 曲式已可玩，但只有三个房间：加兰特图式与诗文分析仍是仅讲解。图式要靠真实演奏辨认伴奏型态，合成骨架听不出原型与例示的差别。
