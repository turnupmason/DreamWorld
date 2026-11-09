# iPhone App（Swift 外壳）

正式版的做法是 **A：Swift 原生壳 + 网页画面**（见 `docs/决策记录.md` D20、D21）：

- 游戏的画面、玩法、界面都在 `prototype/`（网页版），打包时整个文件夹原样放进 App。
- Swift 只做网页做不到的事：读 **Apple 健康**（步数、睡眠、活动圆环、体能训练、正念、心率），通过 JS 桥交给游戏。
- 改网页版 = 改 App。在 Windows 上改完、推到 GitHub，Mac 上拉下来重新运行就是最新的。

## 文件

```
ios/
├── MirrorTown.xcodeproj         Xcode 工程（双击打开）
└── MirrorTown/
    ├── MirrorTownApp.swift      App 入口
    ├── GameView.swift           全屏 WKWebView，加载 prototype/index.html，负责 JS 桥
    ├── HealthBridge.swift       读 Apple 健康，整理成 JSON
    ├── NativeServices.swift     通过 Apple 登录、宠物提醒（本地通知），v0.8.0
    ├── MirrorTown.entitlements  HealthKit 权限
    └── Assets.xcassets          App 图标（占位图，正式上线前换成设计好的）
```

`prototype/` 在工程里是「文件夹引用」（蓝色文件夹），路径 `../prototype`，不用手动复制。所以 App 里的游戏和网页版永远一样：网页版每次更新，Mac 上 `git pull` 后重新编译，App 就是最新的。

## 在 Mac 上第一次运行（Mason）

1. 拉最新代码：`git pull`（仓库 https://github.com/turnupmason/DreamWorld ）。
2. 双击 `ios/MirrorTown.xcodeproj`，用 Xcode 打开。
3. 左边点最上面的 **MirrorTown** 工程 → 中间选 **TARGETS › MirrorTown** → **Signing & Capabilities**：
   - **Team** 选你的 Apple ID（没有就点 Add Account 登录）。
   - 如果提示 Bundle Identifier 被占用，把 `com.mirrortown.app` 改成你自己的，比如 `com.mason.mirrortown`。
   - 应该能看到 **HealthKit** 一项。如果报错说个人免费账号不支持 HealthKit，先把 HealthKit 那一项删掉也能跑（游戏会用模拟数据），付费开发者账号（每年 99 美元）才能正常读健康数据和上架。
4. 用数据线连上 iPhone，顶部设备选你的 iPhone，点 ▶︎ 运行。
   - 第一次装到手机上：iPhone「设置 › 通用 › VPN 与设备管理」里信任你的开发者证书。
   - iPhone 需要打开「开发者模式」（设置 › 隐私与安全性 › 开发者模式）。
5. App 打开后会弹出 Apple 健康授权，全部允许。之后「健康」页顶部的数据来源会显示「Apple 健康」。

没有 iPhone 时也可以选一个模拟器运行，但模拟器里没有真实健康数据。

## 遇到问题

- **编译报错**：把 Xcode 里红色的报错文字（或截图）发回来，Windows 这边改好再推。
- **白屏**：Xcode 菜单 Product › Clean Build Folder 后再运行；确认左侧有蓝色的 `prototype` 文件夹。
- **调试网页部分**：Mac 上的 Safari › 开发 › 你的 iPhone › 镜像小镇，可以看网页的报错（需要 iOS 16.4+）。
- 右上角的 🛠 是原型控制台（模拟数据用的），正式上架前会去掉。

## JS 桥（给以后改代码的人）

| 方向 | 调用 | 内容 |
| --- | --- | --- |
| 网页 → Swift | `window.webkit.messageHandlers.mirror.postMessage({type: 'ready'})` | 游戏加载完，Swift 请求健康授权并开始推数据 |
| 网页 → Swift | `postMessage({type: 'refresh'})` | 打开「健康」页时要一次最新数据 |
| Swift → 网页 | `window.onNativeHealth(json)` | 今天的 steps、pushes、kcal、exMin、standH、mindful、workouts[]（每个训练：id、type 动画类型、**sport：HealthKit 的运动类型编号（v0.10，奖杯用）**、min、kcal、start）、rhr、hrv、resp、sleep{asleep, deep, rem, core, awake, source}。每分钟一次，App 回到前台时也推 |
| Swift → 网页 | `window.onNativeWorkout(json)` | 正在进行的训练 {active, type, start, hr}，小人同步做这个运动 |
| 网页 → Swift | `postMessage({type: 'signIn', provider: 'apple'})` | 点「通过 Apple 登录」（v0.8.0）。Swift 弹出苹果的登录框 |
| Swift → 网页 | `window.onNativeSignIn(json)` | 登录结果 {ok, provider, id, email, name}；失败是 {ok: false, error}，游戏会提示并先用模拟登录 |
| 网页 → Swift | `postMessage({type: 'sportReminders', items: [{id, at, title, body}]})` | v0.54：体育联赛的提醒（每天 10 点今天的比赛、你押的比赛结束），和宠物提醒一样排本地通知，标识以 `sport-` 开头，不会覆盖宠物提醒。 |
| 网页 → Swift | `postMessage({type: 'petReminders', items: [{id, at, title, body}]})` | 宠物下一次需要喂饭 / 换水 / 铲猫砂或遛狗 / 陪伴的时间（毫秒时间戳）。Swift 删掉旧的宠物提醒，按这些时间排本地通知；空列表 = 关掉提醒。第一次会请求通知权限 |

网页端的处理在 `prototype/js/app.js`（`window.onNativeHealth` / `onNativeWorkout`）和 `prototype/js/state.js`（`applyNative`、`startLive`）。

## 位置权限（真实天气，v0.6.0）

- 工程里加了 `NSLocationWhenInUseUsageDescription`（在 Build Settings 的 `INFOPLIST_KEY_NSLocationWhenInUseUsageDescription`）。只有玩家在游戏里打开「用我所在地区的真实天气」时，网页才会请求位置（`navigator.geolocation`），坐标取一位小数（约 10 公里）后向 Open-Meteo 查天气，位置不保存。
- 如果 App 里的网页拿不到位置（WKWebView 对本地文件页面的定位支持不确定），游戏会自动用小镇自己的天气，不会出错。真机上要是一直拿不到，以后改成 Swift 用 CoreLocation 读大概位置，再传给网页（`window.onNativeLocation`）。**等 Mason 在真机上试一下。**

## 通过 Apple 登录（v0.8.0）

- 代码在 `NativeServices.swift` 的 `AppleSignIn`（AuthenticationServices）。
- **要真的能用，需要付费的 Apple Developer 账号**，并在 Xcode 的 Signing & Capabilities 里点「+ Capability」加上 **Sign in with Apple**（会在 entitlements 里加 `com.apple.developer.applesignin`）。免费个人账号加不了这个能力，所以工程里**还没加**，免得 Mason 第一次编译签名失败。没加时点 Apple 登录会收到错误，游戏提示「Apple 登录还没开通」并用模拟登录，不影响试玩。
- Google 登录和邮箱验证码需要服务器（还没做），现在网页里是模拟登录。上架规定：用了 Google 等第三方登录，就必须同时提供「通过 Apple 登录」（App Store 审核指南 4.8），我们两个都有。

## 宠物提醒（v0.8.0）

- `PetReminders.schedule` 用 `UNUserNotificationCenter` 排本地通知（标识都以 `pet-` 开头），不需要服务器。游戏设置里和宠物页都可以关掉「宠物提醒」。
- 第一次有提醒要排时会弹出系统的通知权限请求。
- v0.54：`schedule(items, prefix:)` 多了前缀参数，体育提醒用 `sport-`（`GameView.swift` 的 `case "sportReminders"`）。

**以上 Swift 代码在 Windows 上写的，没经过编译器，等 Mason 在 Mac 上编译。**

## 还没做的

- **实时「迷你的你」**：iPhone 拿不到别的 App 正在进行的训练。要做一个我们自己的 Apple Watch 小 App，在手表上开始训练，用 iOS 17 的「训练镜像」实时传给手机（`HealthBridge` 里已经在监听 `workoutSessionMirroringStartHandler`）。现在训练结束后会自动同步这次训练、发奖励。
- **Oura 准备度 / Whoop 恢复分**：它们写进 Apple 健康的是睡眠阶段和心率，不包括它们自己的评分。要直接拿评分得接它们的开放接口（需要用户登录授权和服务器），之后做。
- **屏幕使用时间**（少刷短视频）：要用 Family Controls / DeviceActivity，需要向苹果申请权限，之后做。
- 朋友、排行、写信目前是单机模拟，正式版需要服务器。
