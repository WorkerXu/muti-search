## 背景与原因

用户希望在同一个本地桌面壳内从通用 AI 搜索扩展到代码仓库阅读。通过输入 GitHub 仓库地址并同时打开 Zread、DeepWiki、CodeWiki，可以把多个代码知识页面聚合到一个工作流里。

## 变更内容

- 新增“代码”Tab 的仓库输入区域，支持 `owner/repo` 和 GitHub URL 两种输入。
- 将仓库输入解析为 `owner` 与 `repo`，例如 `https://github.com/obra/superpowers` 和 `obra/superpowers` 都解析为 `obra/superpowers`。
- 为同一仓库生成三个代码站点页面：
  - `https://zread.ai/{owner}/{repo}`
  - `https://deepwiki.com/{owner}/{repo}`
  - `https://codewiki.google/github.com/{owner}/{repo}`
- 在代码 Tab 中展示三个代码站点的 WebView 状态，并允许用户查看每个站点页面。
- 基于 Chrome 实测，将 `obra/superpowers` 作为实现与测试样例。
- 本 change 只负责仓库解析与页面加载，不实现自动向三个页面提问和导出问答历史。

## 能力范围

### 新增能力

- `code-repository-routing`: 解析 GitHub 仓库输入并路由到 Zread、DeepWiki、CodeWiki 三个代码阅读站点。

### 修改能力

- 无。

## 影响范围

- 影响 `src/main/main.ts` 的 WebView attach 安全白名单，需要允许三个代码阅读站点及其合法路径。
- 影响 `src/renderer/app.ts` 的代码 Tab 状态、仓库输入、URL 解析、代码 WebView 创建与导航逻辑。
- 影响 `src/renderer/styles.css` 的代码 Tab 布局。
- 可能新增共享配置模块，用于描述代码站点 URL 模板、分区和基础 DOM 规则。
- 影响 `tests/mainStartup.test.ts`、`tests/renderer/app.test.ts` 和可能新增的共享单元测试。
