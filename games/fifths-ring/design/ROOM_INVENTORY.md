# 房间清单（唯一口径）

生成方式：直接读 `app/game.js` 的 `ROOMS`，不引用文档里的数字。

| 口径 | 数量 | 说明 |
|---|---|---|
| 全部房间 | 27 | `ROOMS.length` |
| 主线可玩房 | 19 | `kind !== 'locked'`，有判定、通关后计入城区印记 |
| 仅讲解房 | 8 | `kind === 'locked'`，只读，不计入 19、不影响印记与结局 |

## 按玩法

| 玩法 | 数量 | 房间 |
|---|---|---|
| 拼音阶 scale | 3 | r-c-major, r-g-major, r-d-dorian |
| 节奏 rhythm | 2 | r-meter, r-meter2 |
| 对位 counterpoint | 4 | r-cp1, r-cp2, r-cp3, r-cp4 |
| 和声 harmony | 2 | r-func, r-debt |
| 调性罗盘 compass | 2 | r-compass1, r-compass2 |
| 曲式 form | 3 | r-theme, r-sonata, r-rondo |
| 音集 set | 2 | r-normal, r-common |
| 进行 pop | 1 | r-doowop |

## 按城区

| 城区 | 总数 | 可玩 |
|---|---|---|
| 采石场 quarry | 6 | 5 |
| 砌筑区 masonry | 6 | 4 |
| 礼堂 hall | 6 | 4 |
| 工坊 works | 4 | 3 |
| 边地 frontier | 3 | 2 |
| 市集 market | 2 | 1 |

## 历史数字的处理

- **15**：早期只有 15 间带任务卡，QA 历史记录里保留原样，不代表现在。
- **24**：`GAME_DESIGN.md` 里「24 房间」是加节奏桥之前的旧口径，已改为 27。
- **19**：主线可玩房数量，仍是当前有效口径。
- **27**：全部房间数，等于 19 可玩 + 8 讲解。

任何验收数字以本文件的表格为准。
