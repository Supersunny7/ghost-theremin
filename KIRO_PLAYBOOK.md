# Ghost Theremin × Kiro 第一周操作手册

> 目标（11/3–11/9）：配好 `.kiro`，跑通“手一动就出声”，并**实测延迟**。
> 给 Kiro 的提示词都用英文（提交材料要英文，Kiro 理解也更稳），直接复制即可。
> 本文件只是给你看的，不需要放进 Kiro 的上下文里。

---

## Step 0：准备（10 分钟）

1. 在 GitHub 新建 **public** 仓库 `ghost-theremin`，先不要勾选自动生成 README 或 License（这个包里已经有了）。
2. 把这个文件夹解压到本地，然后在里面执行：
   ```bash
   git init
   git add .
   git commit -m "chore: project steering and spec brief"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/ghost-theremin.git
   git push -u origin main
   ```
3. 把 `LICENSE` 里的 “Ghost Theremin contributors” 改成你的名字（可选）。
4. 记得在 **12/1 12:00 PT 前**到 Devpost Resources 页领取 Kiro credits。

## Step 1：用 Kiro 打开项目，检查 steering

1. Kiro → Open Folder → 选 `ghost-theremin`。
2. 打开 Kiro 侧边面板的 **Agent Steering** 区域，应该能看到 4 个文件：
   - `product.md`、`tech.md`：always，每次对话都会加载。
   - `realtime-audio.md`：fileMatch，只在改 engine、audio、vision 文件时加载。
   - `accessibility.md`：fileMatch，只在改 UI 文件时加载。
3. 模型先用 **Auto**。写 spec 或做设计这类需要深度思考的时候，可以切到 Claude Opus 或 Sonnet 试试，并在 journal 里记一笔哪种效果更好（这是写使用说明的好素材）。

## Step 2：Vibe 模式搭脚手架（第一句提示词）

在 Kiro 聊天里用普通（vibe）模式，粘贴：

```
Read the steering docs. Scaffold the project exactly as described in tech.md:
Vite + React + TypeScript (strict), Vitest, fast-check, Playwright, ESLint.
Create the folder layout (src/vision, src/engine, src/audio, src/summon, src/ui, api, tests/engine, tests/e2e)
with placeholder index files, and add the npm scripts: dev, test, test:pbt, lint, typecheck, e2e.
test:pbt should only run files matching tests/engine/**/*.pbt.test.ts.
Do not implement any features yet. When done, run typecheck and test and show me the results.
```

做完后 commit：`git commit -am "chore: scaffold"`。

## Step 3：延迟原型（最重要！先验证可行性）

新开一个分支 `spike/latency`，继续用 vibe 模式：

```
On this spike branch, build the fastest possible proof of concept to measure latency:
- mirrored webcam video
- MediaPipe HandLandmarker (VIDEO mode, GPU delegate if available) tracking the right hand
- right-hand x controls the frequency of a single Tone.js sine oscillator (continuous, no scale yet), y controls gain
- a "Wake the spirits" button that starts the AudioContext
- a debug overlay showing: vision inference ms, our processing ms, fps
Follow realtime-audio.md. Keep it in as few files as possible; this code may be thrown away.
```

**你要做的：** 自己挥手感受一下，并记下 overlay 上的数字。
- 如果“跟手”，就合并回 main，或者只保留经验。
- 如果明显卡顿，把数字发给我，我们一起调（例如降低视频分辨率、换 lite 模型、调 lookAhead）。

把结果写进 `docs/kiro-journal.md`。

## Step 4：用 Spec 模式做核心引擎（展示 Kiro 的重头戏）

1. 在 Kiro 聊天里切换到 **Spec** 模式，新建 spec。
2. 粘贴下面这段（`#` 用来引用文件，输入 `#` 后选择 `docs/spec-briefs/01-core-engine.md`）：

```
Create a feature spec named "core-engine" based on #01-core-engine.md.
Turn the user stories and draft acceptance criteria into proper requirements,
keep the 7 correctness properties and enable property-based testing for them.
Respect the steering rules: src/engine must stay pure and dependency-free.
```

3. **逐步审批：** Kiro 会依次生成 `requirements.md`、`design.md`、`tasks.md`。每一步都**认真读、提修改意见**，不要直接点通过。评委看重你和 spec 的互动过程。
   - 审 requirements 时注意：7 条性质是否都在？阈值（150ms、200ms、两个八度）对不对？
   - 审 design 时注意：engine 是不是纯函数？step 函数是否不分配内存？
4. 按 tasks 一个一个执行（点任务旁边的 Start task）。每完成一个任务就 commit 一次。

## Step 5：创建 Hooks（用 Kiro 界面自然语言创建）

在 Kiro 面板的 **Agent Hooks** 区域点 “+”，用自然语言描述，让 Kiro 生成 hook 文件（生成后会出现在 `.kiro/hooks/`）。建议这 3 个：

1. **PBT 守卫**
   > When the agent saves any file under src/engine/ or tests/engine/, run `npm run test:pbt`. If a property fails, report the shrunk counterexample and propose a fix before continuing.
2. **收工检查**
   > When the agent stops, run `npm run typecheck && npm run lint && npm run test` and summarize any failures.
3. **无障碍审查**
   > When the agent saves a file under src/ui/, review the change against the accessibility steering doc (keyboard access, reduced motion, aria-live, contrast, no flashing over 3 per second) and list any violations.

注意：Kiro 的文件类 hook 只对 **agent 的修改**生效，你自己手动改文件不会触发。

## Step 6：每天花 5 分钟写 journal

`docs/kiro-journal.md` 是之后写 Devpost 使用说明、博客、视频旁白的素材库。重点记这几类：
- PBT 抓到的 bug（附上反例）
- 你改了哪条 steering，Kiro 的表现因此变好了
- spec 和 vibe 模式各自的体验差异
- 不同模型的对比

---

## 遇到问题时，发给我这些

- Kiro 生成的 `requirements.md`、`design.md`、`tasks.md`（我帮你审）
- 报错全文和相关文件
- 延迟数字（Step 3 的结果）
- repo 链接（公开后我可以直接读整个仓库）

## 本周完成标准

- [ ] repo 公开、有 LICENSE、`.kiro/` 已提交
- [ ] 脚手架跑通，`npm run test` 通过
- [ ] 延迟原型实测，结论写进 journal
- [ ] core-engine spec 三个文件已审批
- [ ] 3 个 hooks 已创建
- [ ] 至少开始执行 core-engine 的前几个任务
