# SOURCE_BIBLE — 原著事实与出处

来源仓库 `openmusictheory/openmusictheory.github.io`，本地检出后逐条核对。引用格式为 `文件:行号`。

## 1. 材料性质（决定改编路线）

| 事实 | 出处 |
|---|---|
| 这是一本 Jekyll 搭建的开源乐理教材，130 篇 Markdown 正文，按"基础—严格声部写作—和声—曲式—后调性"组织 | `contents.md:8-60` |
| 教材明确鼓励他人改写复用，条件是署名并以相同协议发布 | `about.md:25` |
| 正文自带交互练习，形态是"谱面上改音、点击发声"（trinket 嵌入） | `cantusFirmus.md:54`、`firstSpecies.md:104-117` |
| 练习的设计原话是"每条都有一两处错误，找出来并重写" | `firstSpecies.md:107` |

**改编判断**：这不是小说，没有主角和情节可拆。它的可玩性在"判据已经写成规则"，因此改编方向不是叙事化，而是把教材的评分标准变成可执行裁判。原文那句"找出错误并改写"就是本作的核心动词，叙事只做外层包装。

## 2. 固定旋律（关卡素材，含真实署名）

来自 `Graphics/counterpoint/cantusFirmi.ly` 的模型固定旋律，Lilypond 谱面源码：

| 关卡 | 旋律 | 调 | 署名 | 出处行 |
|---|---|---|---|---|
| 1 | c d e f g d f e d c | C 大调 | Salzer & Schachter | `cantusFirmi.ly:81-82` |
| 2 | d f e d g f a g f e d | d 小调 | Fux | `cantusFirmi.ly:100-101` |
| 3 | f g a f d e f c' a f g f | F 大调 | Fux | `cantusFirmi.ly:87-88` |
| 4 | d a' g f e d f e d | d 小调 | Jeppesen | `cantusFirmi.ly:103-104` |

四首均以 re–do 收束，符合教材对固定旋律"以 do 起止、导音进主音"的要求（`cantusFirmus.md:23-24`）。第 4 首仅 9 音，用于第二类对位的 2:1 扩展。

音高实现说明：教材原谱固定旋律写在 alto 谱号、约 C4–G4 一带。本作按此音域实现，未移调，仅在渲染时用 alto 谱表配合高音谱表呈现两个相邻声部。旋律的音级与走向与原谱逐一相同。

## 3. 第一类对位规则（引擎判据来源）

| 规则 | 原文要点 | 出处 |
|---|---|---|
| 起始音 | 写在上方时首音为 do 或 sol；写在下方时首音必须是 do | `firstSpecies.md:18` |
| 终止式 | 末音必须是 do；最后两音必须反向级进接近终止；倒数第二音成小三度或大六度 | `firstSpecies.md:24` |
| 双高峰 | 两声部各自的顶点不应重合 | `firstSpecies.md:28` |
| 声部交错／超越 | 禁止 voice crossing 与 voice overlap | `firstSpecies.md:32-34` |
| 音域间距 | 两声部音程不超过纯十二度；尽量保持在一个八度内 | `firstSpecies.md:39` |
| 同度限制 | 同度只允许出现在首尾 | `firstSpecies.md:41` |
| 平行五八度 | 禁止同尺寸纯协和音程连续出现，P5–P12 视同 P5–P5 | `firstSpecies.md:45` |
| 同类型不完美协和 | 同类型不完美协和不得超过连续三个 | `firstSpecies.md:51` |
| 隐伏五八度 | 禁止以同向进行进入纯协和音程 | `firstSpecies.md:52` |

## 4. 第二类对位规则（第 4 关判据）

| 规则 | 原文要点 | 出处 |
|---|---|---|
| 强拍 | 强拍永远协和 | `secondSpecies.md:40` |
| 弱拍不协和 | 弱拍不协和只能是经过音：级进进入、级进离开、同向，且前后强拍协和，两强拍间旋律音程为三度 | `secondSpecies.md:68` |
| 不协和音禁止跳进 | 不得跳进进出不协和音，不得在不协和音上改变方向，强拍不得出现不协和音 | `secondSpecies.md:70` |
| 弱拍同度 | 弱拍同度允许，首尾同度允许 | `secondSpecies.md:24`、`:56` |

## 5. 固定旋律自身规则（用于"乐长点评"的辅助文本，不作硬判定）

长度 8–16 音、全音符、以 do 起止、音域不超过十度、单一顶点、以级进为主、大跳后反向级进（`cantusFirmus.md:21-24`、`:26-27`、`:29-32`）。

## 6. 术语表（界面统一用词）

cantus firmus 固定旋律；counterpoint 对位声部；species 对位类别；perfect consonance 纯协和；imperfect consonance 不完美协和；contrary motion 反向进行；similar motion 同向进行；parallel fifths 平行五度；hidden octaves 隐伏八度；voice crossing 声部交错；voice overlap 声部超越；passing tone 经过音；leading tone 导音。

## 7. 未采信与风险

- 教材中大量 Vimeo 与 trinket 嵌入已失效或依赖外部服务，本作不复用这些嵌入。
- 教材 PDF 与 PNG 谱例不搬入本作，谱面全部自行绘制；只复用旋律数据与规则文本，并已在游戏内署名。
- 音频不复用仓库 `media/` 下的 mp3：这些是特定实例录音，与本作四个练习不对应，改用 Web Audio 现场合成，保证每个音与玩家操作一一对应。
