# Ghost Theremin × Kiro 第一周操作手册

> 目标（11/3–11/9）：配好 `.kiro`，跑通“手一动就出声”，并**实测延迟**。
> 给 Kiro 的提示词都用英文（提交材料要英文，Kiro 理解也更稳），直接复制即可。
> 本文件只是给你看的，不需要放进 Kiro 的上下文里。

---

## 先认识一下：在 Kiro 里做 git 操作的三个地方

Kiro 的界面基于 VS Code，所以 git 操作和 VS Code 一样，有三种方式，任选其一：

| 地方 | 怎么打开 | 适合做什么 |
|---|---|---|
| **① 终端（Terminal）** | 顶部菜单 **Terminal → New Terminal**，或快捷键 **Ctrl + `**（反引号，Esc 下面那个键；Mac 也是 Ctrl，不是 Cmd） | 输入 git 命令。本手册以这种方式为准，最不容易出错 |
| **② 源代码管理面板（Source Control）** | 左侧竖排图标里那个“分叉树枝”的图标，或快捷键 **Ctrl+Shift+G**（Mac：**Cmd+Shift+G**） | 看改了哪些文件、写提交说明、点按钮提交和推送 |
| **③ 左下角状态栏的分支名** | 窗口**最左下角**显示着 `main` 的地方，点一下 | 切换分支、新建分支 |

每次提交（commit）后，记得**推送（push）**到 GitHub，不然 GitHub 上看不到，评委也看不到。

### 标准“提交 + 推送”做法（之后每一步都按这个来）

**方式 ①：终端**（推荐）
```bash
git add .
git commit -m "这里写这次做了什么"
git push
```

**方式 ②：Source Control 面板**
1. 点左侧“分叉树枝”图标，打开 Source Control 面板。
2. 在顶部的输入框（写着 Message）里写提交说明。
3. 点下方蓝色的 **Commit** 按钮。如果弹窗问 “stage all changes?”，选 **Yes / Always**。
4. 按钮会变成 **Sync Changes** 或 **Publish Branch**，点它就会推送到 GitHub。

---

## Step 0：准备 ✅ 已完成

- GitHub 仓库已建好并推送：https://github.com/Supersunny7/ghost-theremin
- 剩下一件事：**12/1 12:00 PT 前**到 Devpost Resources 页领取 Kiro credits。

## Step 1：把仓库拉到电脑上，用 Kiro 打开

1. **打开你电脑自带的终端**（Mac：按 Cmd+空格，搜 “Terminal”；Windows：开始菜单搜 “PowerShell”）。
2. 进入你想放项目的位置（比如桌面），然后克隆：
   ```bash
   cd ~/Desktop
   git clone https://github.com/Supersunny7/ghost-theremin.git
   ```
3. 打开 Kiro → 顶部菜单 **File → Open Folder** → 选刚才的 `ghost-theremin` 文件夹。
4. 点左侧的 **Kiro 图标**（幽灵图标）打开 Kiro 面板，找到 **Agent Steering** 区域，应该能看到 4 个文件：
   - `product.md`、`tech.md`：always，每次对话都会加载。
   - `realtime-audio.md`：fileMatch，只在改 engine、audio、vision 文件时加载。
   - `accessibility.md`：fileMatch，只在改 UI 文件时加载。
5. 打开 Kiro 内置终端（**Ctrl + `**），输入 `git status`。看到 `On branch main` 和 `nothing to commit`，说明一切就绪。
6. 模型先用 **Auto**（聊天输入框附近可以切换模型）。写 spec 或做设计这类需要深度思考的时候，可以切到 Claude Opus 或 Sonnet 试试，并在 journal 里记一笔哪种效果更好（这是写使用说明的好素材）。

## Step 2：Vibe 模式搭脚手架（在 main 分支上做）

1. 确认左下角显示的是 `main`。
2. 在 Kiro 聊天框里用普通（vibe）模式，粘贴：

```
Read the steering docs. Scaffold the project exactly as described in tech.md:
Vite + React + TypeScript (strict), Vitest, fast-check, Playwright, ESLint.
Create the folder layout (src/vision, src/engine, src/audio, src/summon, src/ui, api, tests/engine, tests/e2e)
with placeholder index files, and add the npm scripts: dev, test, test:pbt, lint, typecheck, e2e.
test:pbt should only run files matching tests/engine/**/*.pbt.test.ts.
Do not implement any features yet. When done, run typecheck and test and show me the results.
```

3. Kiro 可能会请求运行 `npm install` 等命令，点 **Run / Accept** 允许。
4. 等 Kiro 说完成、并且显示 typecheck 和 test 通过后，**提交并推送**。在 Kiro 内置终端（Ctrl + `）输入：
   ```bash
   git add .
   git commit -m "chore: scaffold Vite + React + TS project"
   git push
   ```
5. 去 GitHub 仓库页面刷新，应该能看到新文件。

> 💡 提交前用 `git status` 看一眼：`node_modules/` 不应该出现在列表里（已经被 .gitignore 忽略了）。如果出现了，先别提交，告诉我。

## Step 3：在新分支上做延迟原型（最重要！先验证可行性）

原型代码可能会扔掉，所以放在单独的分支上，不弄乱 main。

### 3.1 新开分支

**方式 ①：终端**（推荐）。在 Kiro 内置终端输入：
```bash
git checkout -b spike/latency
```
看到 `Switched to a new branch 'spike/latency'` 就成功了，左下角会变成 `spike/latency`。

**方式 ③：左下角**
1. 点窗口最左下角的 `main`。
2. 顶部弹出的菜单里选 **+ Create new branch...**。
3. 输入 `spike/latency`，回车。

### 3.2 让 Kiro 做原型

确认左下角显示 `spike/latency`，然后在聊天框粘贴：

```
On this spike branch, build the fastest possible proof of concept to measure latency:
- mirrored webcam video
- MediaPipe HandLandmarker (VIDEO mode, GPU delegate if available) tracking the right hand
- right-hand x controls the frequency of a single Tone.js sine oscillator (continuous, no scale yet), y controls gain
- a "Wake the spirits" button that starts the AudioContext
- a debug overlay showing: vision inference ms, our processing ms, fps
Follow realtime-audio.md. Keep it in as few files as possible; this code may be thrown away.
```

### 3.3 自己试玩

1. 在 Kiro 内置终端运行 `npm run dev`，终端会显示一个地址（通常是 `http://localhost:5173`）。按住 Cmd/Ctrl 点它，用 **Chrome** 打开。
2. 允许摄像头，点 “Wake the spirits”，挥手感受。
3. 记下 overlay 上的数字。试完在终端按 **Ctrl + C** 停止服务器。

### 3.4 提交原型分支

```bash
git add .
git commit -m "spike: latency proof of concept"
git push -u origin spike/latency
```
（新分支第一次推送要加 `-u origin 分支名`，之后直接 `git push` 就行。）

### 3.5 根据结果决定

- **“跟手”，体验不错：** 原型分支留着当参考就行，正式代码会在 Step 4 用 spec 重新写。切回 main：
  ```bash
  git checkout main
  ```
  （或者点左下角的分支名，选 `main`。）
- **明显卡顿：** 把 overlay 上的数字和你的电脑型号发给我，我们一起调（例如降低视频分辨率、换 lite 模型、调 lookAhead）。

把结果写进 `docs/kiro-journal.md`，**切回 main 后**提交：
```bash
git add docs/kiro-journal.md
git commit -m "docs: log latency spike results"
git push
```

## Step 4：用 Spec 模式做核心引擎（展示 Kiro 的重头戏）

### 4.1 新开功能分支

先确认在 main 上，并拿到最新代码，再开新分支：
```bash
git checkout main
git pull
git checkout -b feat/core-engine
```

### 4.2 创建 spec

1. 在 Kiro 聊天里切换到 **Spec** 模式，新建 spec。
2. 粘贴下面这段（`#` 用来引用文件，输入 `#` 后选择 `docs/spec-briefs/01-core-engine.md`）：

```
Create a feature spec named "core-engine" based on #01-core-engine.md.
Turn the user stories and draft acceptance criteria into proper requirements,
keep the 7 correctness properties and enable property-based testing for them.
Respect the steering rules: src/engine must stay pure and dependency-free.
```

### 4.3 逐步审批

Kiro 会依次生成 `requirements.md`、`design.md`、`tasks.md`（位置在 `.kiro/specs/core-engine/`）。每一步都**认真读、提修改意见**，不要直接点通过。评委看重你和 spec 的互动过程。
- 审 requirements 时注意：7 条性质是否都在？阈值（150ms、200ms、两个八度）对不对？
- 审 design 时注意：engine 是不是纯函数？step 函数是否不分配内存？

三个文件都审批完后，提交一次（spec 本身就是重要的评审证据）：
```bash
git add .kiro/specs
git commit -m "spec: core-engine requirements, design, tasks"
git push -u origin feat/core-engine
```

### 4.4 按任务执行，每完成一个就提交

1. 打开 `.kiro/specs/core-engine/tasks.md`，点任务旁边的 **Start task**。
2. 每完成一个任务、测试通过后，提交一次：
   ```bash
   git add .
   git commit -m "feat(engine): <任务名，例如 add scale quantizer>"
   git push
   ```

### 4.5 全部任务完成后合并回 main

**推荐用 GitHub 网页合并**（会留下 Pull Request 记录，评委能看到开发过程）：
1. 打开 https://github.com/Supersunny7/ghost-theremin ，页面顶部会出现黄色提示条 “feat/core-engine had recent pushes”，点 **Compare & pull request**。
2. 标题写 “Core gesture-to-sound engine”，点 **Create pull request**。
3. 再点 **Merge pull request → Confirm merge**。
4. 回到 Kiro 内置终端，同步本地：
   ```bash
   git checkout main
   git pull
   ```

## Step 5：创建 Hooks（用 Kiro 界面自然语言创建）

在 main 分支上做（左下角确认是 `main`）。

在 Kiro 面板的 **Agent Hooks** 区域点 “+”，用自然语言描述，让 Kiro 生成 hook 文件（生成后会出现在 `.kiro/hooks/`）。建议这 3 个：

1. **PBT 守卫**
   > When the agent saves any file under src/engine/ or tests/engine/, run `npm run test:pbt`. If a property fails, report the shrunk counterexample and propose a fix before continuing.
2. **收工检查**
   > When the agent stops, run `npm run typecheck && npm run lint && npm run test` and summarize any failures.
3. **无障碍审查**
   > When the agent saves a file under src/ui/, review the change against the accessibility steering doc (keyboard access, reduced motion, aria-live, contrast, no flashing over 3 per second) and list any violations.

注意：Kiro 的文件类 hook 只对 **agent 的修改**生效，你自己手动改文件不会触发。

创建完提交：
```bash
git add .kiro/hooks
git commit -m "chore: add PBT, stop-check, and a11y hooks"
git push
```

> 💡 其实 hooks 最好在 Step 4 开始执行任务**之前**就建好，这样 PBT 守卫能在写引擎时就起作用。如果你方便，可以先做 Step 5 再做 4.4。

## Step 6：每天花 5 分钟写 journal

`docs/kiro-journal.md` 是之后写 Devpost 使用说明、博客、视频旁白的素材库。重点记这几类：
- PBT 抓到的 bug（附上反例）
- 你改了哪条 steering，Kiro 的表现因此变好了
- spec 和 vibe 模式各自的体验差异
- 不同模型的对比

写完提交：
```bash
git add docs/kiro-journal.md
git commit -m "docs: journal <日期>"
git push
```

---

## Git 速查表

| 想做什么 | 终端命令 | 或者在界面上 |
|---|---|---|
| 看当前状态和分支 | `git status` | 看左下角分支名 + Source Control 面板 |
| 提交 | `git add .` 然后 `git commit -m "说明"` | Source Control 面板：写说明 → Commit |
| 推送到 GitHub | `git push` | Source Control 面板：Sync Changes |
| 新建并切换到新分支 | `git checkout -b 分支名` | 左下角分支名 → Create new branch |
| 新分支第一次推送 | `git push -u origin 分支名` | Source Control 面板：Publish Branch |
| 切换分支 | `git checkout 分支名` | 左下角分支名 → 选分支 |
| 拉取 GitHub 上的最新代码 | `git pull` | Source Control 面板：Sync Changes |
| 放弃还没提交的所有改动（小心！） | `git restore .` | Source Control 面板：文件旁的 ↶ 按钮 |

**分支命名约定：** `spike/xxx` 是试验原型，`feat/xxx` 是新功能，`fix/xxx` 是修 bug。

**切换分支前**，先把当前改动提交了，否则 git 可能不让你切，或者把改动带到别的分支上。

---

## 遇到问题时，发给我这些

- Kiro 生成的 `requirements.md`、`design.md`、`tasks.md`（我帮你审）
- 报错全文和相关文件
- 延迟数字（Step 3 的结果）
- 推送到 GitHub 后直接说一声，我可以读整个仓库

## 本周完成标准

- [x] repo 公开、有 LICENSE、`.kiro/` 已提交
- [ ] 脚手架跑通，`npm run test` 通过，已推送
- [ ] 延迟原型实测（`spike/latency` 分支），结论写进 journal
- [ ] 3 个 hooks 已创建
- [ ] core-engine spec 三个文件已审批并提交（`feat/core-engine` 分支）
- [ ] 至少开始执行 core-engine 的前几个任务
