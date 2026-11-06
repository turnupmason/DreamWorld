# 镜像小镇 Mirror Town

一款 iPhone 手机游戏（正式版做原生 App，先上美国 App Store）：现实里运动、睡好、少刷短视频，游戏里那个迷你的你就能种地养殖、盖房买车、布置自己的家，和朋友住在同一条街上。

- 玩法和内容：`docs/游戏设计.md`
- 技术方案：`docs/技术方案.md`
- 历史版本：`CHANGELOG.md`
- 网页玩法原型：`prototype/`（说明见 `prototype/README.md`），只用来验证玩法和做访谈，不是正式版

## 和用户沟通

- 一律用中文回复。
- 用户在 Mac 上有 Xcode，这台 Windows 电脑负责写代码和测试，用户从 GitHub 拉代码到 Mac 上打包。
- 仓库：https://github.com/turnupmason/DreamWorld （分支 `master`）

## 每次更新都要做（不用等用户提醒）

1. 改完代码或文档后，自己测试（网页原型在手机尺寸下测）。
2. 定新版本号：原型阶段用 `0.x.y`。新功能或大改动升 `x`，小修小补升 `y`。
3. 在 `CHANGELOG.md` 最上面加一节：`## vX.Y.Z · 日期`，用中文写这一版改了什么。
4. 网页原型里的版本号同步改：`prototype/js/data.js` 的 `VERSION`。如果改了原型的 JS 或 CSS，把 `prototype/index.html` 里的 `?v=` 也加一，避免浏览器用旧缓存。
5. 提交（提交说明用简短英文），打标签并推送：

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z 一句话说明"
   git push origin master --tags
   ```

## 设计原则（改动前先看）

- 钱只从现实来：金币、木材最初都来自运动、睡眠和少刷手机，木材只能从现实拿。
- 只为真实的社交事件推送，不催收菜。
- 健康和屏幕数据默认私密，排行只比家产；原始健康数据只留在手机上。
- 外观不受数据影响，精力只改变表情和动作。
- 包容：轮椅、休息日 / 生病选项。
- 每天农活有上限：「今天的活干完了，去过你的生活吧」。

## 本地运行网页原型

```bash
python -m http.server 5173 --directory prototype
```

然后打开 http://localhost:5173 。
