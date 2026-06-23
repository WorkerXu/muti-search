---
comet_change: add-code-repository-tab
role: technical-design
canonical_spec: openspec
---

# 代码仓库 Tab 路由设计

## 背景

`代码` Tab 目前只是本地占位区。这个 change 要把它变成仓库阅读入口：用户输入 GitHub 仓库地址或 `owner/repo` 简写后，应用同时打开 Zread、DeepWiki、CodeWiki 三个代码知识页面。

本 change 的边界只到仓库解析与页面加载。自动向代码站点提问、问答历史和 Markdown 导出由后续 change 实现；WebView 生命周期和内存优化由 `optimize-webview-lifecycle` 实现。

## 确认方案

采用方案 A：共享模型 + 代码 Tab 三站并列加载。

新增共享模块 `src/shared/codeSites.ts` 作为代码仓库路由的唯一规则源：

- 定义三个代码站点：Zread、DeepWiki、CodeWiki。
- 解析并归一化 GitHub 仓库输入。
- 基于归一化仓库生成三个目标 URL。
- 定义独立持久化 partition。
- 提供 main 进程可复用的代码站点 WebView config 校验。

Renderer 只负责 UI 状态和导航触发；main 进程只负责 attach 安全校验。两端共用共享模块，避免 URL 规则或 partition 规则重复实现。

## 共享模型

### 类型

```ts
type CodeSiteId = 'zread' | 'deepwiki' | 'codewiki';
type NormalizedRepository = `${string}/${string}`;
type CodeSitePartition<T extends CodeSiteId = CodeSiteId> = `persist:code-${T}`;
```

### 代码站点定义

每个代码站点定义包含：

- `id`
- `name`
- `origin`
- `partition`
- `buildUrl(repo)`
- `matchesUrlForRepo(url, repo)`

URL 规则：

- Zread: `https://zread.ai/{owner}/{repo}`
- DeepWiki: `https://deepwiki.com/{owner}/{repo}`
- CodeWiki: `https://codewiki.google/github.com/{owner}/{repo}`

### 仓库输入解析

`normalizeGitHubRepositoryInput(input)` 返回：

```ts
{ ok: true; repository: NormalizedRepository }
```

或：

```ts
{ ok: false; errorMessage: string }
```

支持输入：

- `obra/superpowers`
- `https://github.com/obra/superpowers`
- `https://github.com/obra/superpowers.git`
- `https://github.com/obra/superpowers/tree/main`
- `https://github.com/obra/superpowers/blob/main/README.md`
- 带 query/hash 的 GitHub URL

拒绝输入：

- 非 GitHub URL，例如 `https://example.com/obra/superpowers`
- 缺少 owner 或 repo
- 多余路径无法对应 GitHub 仓库语义
- 包含空白、非法路径片段或空字符串

仓库 owner 和 repo 只允许 GitHub 常见安全字符：字母、数字、点、下划线、短横线。归一化保留用户输入大小写，但测试样例使用小写。

## Main 进程安全

现有 `isAllowedWebviewConfig(src, partition)` 只允许搜索服务的精确主页 URL。新增代码站点后，校验逻辑扩展为两段：

1. 先检查现有搜索服务 config。
2. 再检查代码站点 config。

代码站点 config 被允许的条件：

- `partition` 等于该站点定义的独立 partition。
- `src` 是有效 `http:` 或 `https:` URL。
- URL origin 等于对应站点 origin。
- URL path 必须匹配该站点的仓库页面规则，并能还原为合法 `owner/repo`。

这避免只按 origin 放行导致任意路径被加载，也避免不同代码站点共用 session partition。

`isAllowedExternalUrl(url)` 可继续只允许搜索服务 origin。本 change 不要求通过系统浏览器打开代码站点外链。

## Renderer UI

`代码` Tab 从占位区升级为仓库工作流：

- 顶部显示仓库输入框，placeholder 可用 `输入 GitHub 仓库，如 obra/superpowers`。
- 提供一个“打开仓库”按钮。
- 输入有效后显示当前归一化仓库，例如 `obra/superpowers`。
- 渲染三个代码站点 pane，显示站点名、状态点和错误信息。
- 每个 pane 包含一个 `<webview>`，有效仓库提交后设置对应 `src` 与 `partition`。

无效输入时：

- 展示错误提示。
- 不设置或改变代码站点 WebView 的 `src`。
- 已加载的仓库页面保持不变，避免用户误输入后丢失当前上下文。

初始状态：

- 代码站点 pane 可以存在，但 WebView 不导航远程页面。
- 推荐使用空 `src` 或不设置 `src`，并在 pane body 显示等待输入状态。
- 只有仓库输入有效并提交后才导航三个代码站点。

## 数据流

1. 用户切换到 `代码` Tab。
2. 用户输入仓库文本。
3. Renderer 调用 `normalizeGitHubRepositoryInput()`。
4. 解析失败：展示错误，不导航。
5. 解析成功：保存当前 repository，调用 `buildCodeSiteUrl(site, repository)` 生成三个 URL。
6. Renderer 将三个 WebView 的 `src` / `partition` 设置为生成结果。
7. Electron `will-attach-webview` 触发 main 进程校验。
8. main 进程调用共享校验 helper，允许合法站点并阻止任意 origin、任意路径或 partition 不匹配。

## 状态与错误

代码站点 pane 状态可复用搜索 pane 的视觉语言，但不复用搜索发送状态：

- `idle`：等待仓库输入。
- `loading`：已设置 URL，等待 WebView ready。
- `ready`：页面加载完成。
- `error`：WebView 加载失败或仓库输入无效。

本 change 不需要实现代码站点的发送状态、回答抽取状态或导出状态。

## 测试策略

### 共享单元测试

新增 `tests/shared/codeSites.test.ts`：

- `obra/superpowers` 归一化成功。
- `https://github.com/obra/superpowers` 归一化成功。
- `.git` 后缀归一化成功。
- `tree/...`、`blob/...`、query/hash 归一化成功。
- 非 GitHub URL、缺少 owner/repo、空字符串解析失败。
- `obra/superpowers` 生成三个预期 URL。
- 代码站点 partition 为 `persist:code-zread`、`persist:code-deepwiki`、`persist:code-codewiki`。

### Main 进程测试

更新 `tests/mainStartup.test.ts`：

- 有效代码站点 URL + 匹配 partition 允许 attach。
- 任意 origin 被拒绝。
- 已知 origin 但无效仓库 path 被拒绝。
- 有效 URL 但 partition 不匹配被拒绝。
- 搜索服务现有白名单测试继续通过。

### Renderer 测试

更新 `tests/renderer/app.test.ts`：

- 代码 Tab 初始不加载远程代码站点 WebView。
- 输入 `obra/superpowers` 并点击“打开仓库”后渲染三个代码站点 pane。
- 三个代码站点 pane 的 `src` 和 `partition` 正确。
- 输入无效仓库时显示错误，且不导航任何代码站点 WebView。

## Spec Patch

回写 delta spec：补充“有效仓库输入前不导航远程代码站点”的验收场景。这个场景把设计中的懒导航边界固化为规格，避免代码 Tab 初始加载额外远程页面。

## 非目标

- 不实现代码站点 Ask AI 自动提问。
- 不实现代码问答历史导出。
- 不改变搜索服务发送逻辑。
- 不引入 WebView 生命周期优化策略。
- 不处理私有仓库认证。

