# ai-sim-games


按游戏分目录存放的可玩作品集合。每个目录独立运行，互不依赖。

| 目录 | 作品 | 说明 |
|---|---|---|
| `games/fifths-ring/` | 五度环 | 把开源乐理教材改造成可玩的城邦游戏：五类音乐决策、六个城区、化身与印记 |
| `games/aircraft-manufacturer/` | 适航 | 《适航》飞机制造经营模拟。18 个季度，把一架飞机送过设计冻结、首飞、TC、PC 五道门，交付 25 架。纯静态前端，无依赖。 |

各目录的启动方式与测试方法写在该目录自己的 README 里。

## GitHub Pages

站点由 `.github/workflows/deploy-pages.yml` 在 `main` 更新时自动构建并部署：

- `/`：游戏选择页
- `/games/fifths-ring/`：五度环
- `/games/aircraft-manufacturer/`：适航

本地预览打包后的 Pages 站点：

```bash
bash scripts/build-pages.sh
python3 -m http.server 8000 --directory dist
```

然后访问 <http://localhost:8000/>。构建产物 `dist/` 不提交到 Git，由 GitHub Actions 直接上传到 GitHub Pages。仓库 Pages 的 **Source** 需要设置为 **GitHub Actions**。
