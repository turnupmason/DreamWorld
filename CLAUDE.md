# 镜像小镇 Mirror Town

一款 iPhone 手机游戏（Swift 原生外壳 + 网页画面，先上美国 App Store）：现实里运动、睡好、少刷短视频，游戏里那个迷你的你就能种地养殖、盖房买车、布置自己的家，和朋友住在同一条街上。

结构：`prototype/` 是游戏本体（画面、玩法、界面），`ios/` 是 Swift 外壳（全屏运行 prototype，读 Apple 健康）。改游戏就改 `prototype/`。

画风：网页版的 2.5D 等距卡通风格，在它的基础上完善。不用 Unity、不用 3D 低多边形素材（Mason 试过，觉得丑）。

## 新对话先读这些（按顺序），读完就能接着做，不要再问 Mason 已经写在文档里的事

1. `docs/交接.md`：现在做到哪、等谁决定什么、下一步、环境、Mason 的偏好。
2. `docs/需求记录.md`：Mason 每次提的需求和状态。
3. `docs/决策记录.md`：做过的决定和原因。
4. `docs/核心设计.md`：为什么玩、卖点、终局、不运动的人、怎么避免压力。
5. `docs/游戏设计.md`：正式版玩法。
6. `docs/数值表.md`：全部内容和数值（由 `prototype/js/data.js` 生成）；`docs/数值平衡.md`：收入、支出和物价是怎么定的。
7. `docs/技术方案.md`：App 技术方案（Swift 壳 + 网页画面）。
8. `ios/README.md`：iPhone App 在 Mac 上怎么跑、JS 桥。
9. 要改游戏代码时读 `docs/原型代码说明.md`。
10. `docs/产品概念.md`：最初的产品概念（Mason 的 PDF 转写）。

## 和 Mason 沟通

- 一律用中文回复。
- Mason 在 Mac 上有 Xcode；这台 Windows 电脑负责写代码和测试，Mason 从 GitHub 拉代码到 Mac 上打包。
- 仓库：https://github.com/turnupmason/DreamWorld （分支 `master`）。
- 所有信息都要写进 md 文件：新需求、决定、进度都要落到文档里，不能只留在对话里。

## 每次更新都要做（不用等 Mason 提醒）

1. 改完代码或文档后自己测试（网页原型在手机尺寸下测）。
2. 同步更新文档：
   - `docs/需求记录.md`：Mason 这次提的新需求（原话要点 + 状态），旧需求状态有变也要改。
   - `docs/决策记录.md`：新决定，或者改了哪条旧决定。
   - `docs/交接.md`：现状、下一步、等谁决定什么、环境变化、「最后更新」日期和版本。
   - 改了玩法或数值，就同步改 `docs/游戏设计.md`；数值只改 `prototype/js/data.js`，再运行 `node docs/生成数值表.js`。
   - 改了 `ios/` 或 JS 桥，同步改 `ios/README.md`。Swift 在这台电脑上编译不了，改完要在交接里写明「等 Mason 在 Mac 上编译」。
3. 定新版本号：原型阶段用 `0.x.y`。新功能或大改动升 `x`，小修小补和只改文档升 `y`。
4. 在 `CHANGELOG.md` 最上面加一节：`## vX.Y.Z · 日期`，用中文写这一版改了什么。
5. 版本号同步改：`prototype/js/data.js` 的 `VERSION`，以及 `ios/MirrorTown.xcodeproj/project.pbxproj` 里的 `MARKETING_VERSION`（两处）。如果改了原型的 JS 或 CSS，把 `prototype/index.html` 里的 `?v=` 也加一，避免浏览器用旧缓存。
6. 提交（提交说明用简短英文），打标签并推送：

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z 一句话说明"
   git push origin master --tags
   ```

## 设计原则（改动前先看，详见 `docs/产品概念.md` 和 `docs/决策记录.md`）

- 钱主要从现实来：金币最初来自运动、睡眠和少刷手机；v0.14 起 Mason 定了也能在游戏里打工、到市场卖东西挣金币（D102）。木材只能从现实拿。
- 只为真实的社交事件推送，不催收菜。
- 健康和屏幕数据默认私密，排行只比家产；原始健康数据只留在手机上。
- 外观不受数据影响，精力只改变表情和动作。
- 包容：轮椅、休息日 / 生病选项。
- 每天农活有上限：「今天的活干完了，去过你的生活吧」。
- 合作为主：偷菜只是小恶作剧，不做让人心痛的抢夺。
- 比家不比人、比自己不比别人：奖励按自己的目标算，分享默认全关，有安静模式。
- 新用户少字多图，有手指引导。

## 本地运行网页原型

```bash
python -m http.server 5173 --directory prototype
```

然后打开 http://localhost:5173 。

线上试玩（每次推送到 master 后自动更新）：https://turnupmason.github.io/DreamWorld/ （发布脚本 `.github/workflows/pages.yml`）。
