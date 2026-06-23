# Comet Design Handoff

- Change: add-code-repository-tab
- Phase: design
- Mode: compact
- Context hash: 2f2c10050728787e13d9d83ae5956347db60225913d9a8f11b0a1f66348e1747

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/add-code-repository-tab/proposal.md

- Source: openspec/changes/add-code-repository-tab/proposal.md
- Lines: 1-33
- SHA256: 4de0865b6ad7fcd81b96733c32ce03b80946f77dda872d40aa0643b5c9b5dfce

```md
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
```

## openspec/changes/add-code-repository-tab/design.md

- Source: openspec/changes/add-code-repository-tab/design.md
- Lines: 1-50
- SHA256: e430c734bfd5622fdc9cb189cacf05e5b6c9caa84714f571fa258ef7ba09ceea

```md
## 上下文

产品将新增“代码”工作流，用于打开面向 GitHub 仓库的 AI 代码文档页面。使用 Chrome 对 `obra/superpowers` 实测后，确认以下 URL 可直接解析：

- `https://zread.ai/obra/superpowers`
- `https://deepwiki.com/obra/superpowers`
- `https://codewiki.google/github.com/obra/superpowers`

现有应用已经在 `<webview>` attach 阶段校验 URL 与 partition。代码站点路由必须沿用这个安全模型，不能因为新增代码页而允许任意远程页面。

## 目标与非目标

**目标：**

- Accept GitHub repository input as `owner/repo` or GitHub URL.
- Normalize valid input to `owner/repo`.
- Generate and load the three code-site URLs for Zread, DeepWiki, and CodeWiki.
- Use `obra/superpowers` as the fixture and manual verification example.
- Show per-site name, status, and error state in the code Tab.

**非目标：**

- Do not automate questions in this change.
- Do not implement history export in this change.
- Do not solve private repository authentication.

## 设计决策

- Add a separate code-site definition list instead of mixing code sites into the existing search `services`. Search services and code sites have different URL templates, send behavior, and export semantics.
- Use dedicated persistent partitions such as `persist:code-zread`, `persist:code-deepwiki`, and `persist:code-codewiki` so code-site cookies do not mix with search service sessions.
- Permit only generated URLs whose origin matches the three known code sites and whose path matches a normalized GitHub repository route.
- Keep repository parsing local and deterministic: strip `https://github.com/`, optional trailing slash, `.git`, `tree/...`, `blob/...`, and query/hash fragments; reject missing owner or repo.
- Do not load code-site WebViews until the user enters a valid repository in the code Tab.

## 风险与取舍

- [风险] CodeWiki 和 DeepWiki 的 URL 规则可能变化 → 缓解：集中维护 URL 构造器，并用 `obra/superpowers` 覆盖测试。
- [风险] 用户输入非 GitHub URL → 缓解：展示校验错误，不导航任何页面。
- [风险] WebView attach 白名单过宽 → 缓解：同时校验 origin、生成后的仓库路径和 partition，不只校验 origin。

## 迁移计划

1. Add code-site definitions and repository parsing helpers.
2. Extend main-process WebView validation for code-site partitions and generated URLs.
3. Add code Tab repository input and three code-site panes.
4. Add renderer and main-process tests for `obra/superpowers` routing.

## 未决问题

- Whether code-site partitions should be shown in the settings path list; this change can include static paths if the UI already lists runtime partitions.
```

## openspec/changes/add-code-repository-tab/tasks.md

- Source: openspec/changes/add-code-repository-tab/tasks.md
- Lines: 1-31
- SHA256: 81a62744d3f12409b30af1664a9c555950389a1d03eec4d1883362c90ca10541

```md
## 1. 测试

- [ ] 1.1 增加共享测试，覆盖 `owner/repo`、GitHub URL、`.git` 后缀和无效输入解析。
- [ ] 1.2 增加共享测试，确认 `obra/superpowers` 会生成预期的 Zread、DeepWiki 和 CodeWiki URL。
- [ ] 1.3 增加主进程测试，覆盖代码站点 WebView 白名单与 partition 匹配。
- [ ] 1.4 增加 renderer 测试，覆盖输入仓库并渲染三个代码站点 pane。

## 2. 共享代码站点模型

- [ ] 2.1 增加 Zread、DeepWiki 和 CodeWiki 的代码站点定义。
- [ ] 2.2 增加仓库输入归一化与校验 helper。
- [ ] 2.3 增加三个代码站点的 URL 构造器。
- [ ] 2.4 为代码站点增加独立持久化 partition。

## 3. 主进程安全

- [ ] 3.1 扩展 WebView config 校验，允许生成后的代码站点 URL。
- [ ] 3.2 拒绝任意 origin、无效仓库路径和不匹配的代码站点 partition。

## 4. Renderer 集成

- [ ] 4.1 在代码 Tab 中增加仓库输入框和提交动作。
- [ ] 4.2 渲染三个代码站点 pane，并展示名称、状态和错误。
- [ ] 4.3 仅在仓库输入有效后导航代码站点 WebView。
- [ ] 4.4 展示校验错误时不导航现有页面。

## 5. 验证

- [ ] 5.1 Run `npm run typecheck`.
- [ ] 5.2 Run `npm test`.
- [ ] 5.3 Run `npm run build`.
```

## openspec/changes/add-code-repository-tab/specs/code-repository-routing/spec.md

- Source: openspec/changes/add-code-repository-tab/specs/code-repository-routing/spec.md
- Lines: 1-51
- SHA256: 4998a1714ecb8d39a90951d0e40066df9e87119a9d01a0d3984a81b098eb4f08

```md
## ADDED Requirements

### Requirement: GitHub 仓库输入会被归一化

系统 SHALL 接受 `owner/repo` 或 GitHub URL 形式的仓库输入，并将其归一化为 `owner/repo`。

#### Scenario: owner/repo 简写

- **WHEN** 用户输入 `obra/superpowers`
- **THEN** 系统将仓库归一化为 `obra/superpowers`

#### Scenario: 完整 GitHub URL

- **WHEN** 用户输入 `https://github.com/obra/superpowers`
- **THEN** 系统将仓库归一化为 `obra/superpowers`

#### Scenario: 无效仓库输入

- **WHEN** 用户输入无法解析为 GitHub owner 和 repo 的文本
- **THEN** 系统展示校验错误
- **AND** 不导航任何代码站点 WebView

### Requirement: 代码站点会按仓库加载

系统 SHALL 基于归一化仓库生成 Zread、DeepWiki 和 CodeWiki URL，并在代码工作流中加载这些页面。

#### Scenario: 有效仓库输入前不导航远程代码站点

- **WHEN** 用户尚未提交有效仓库输入
- **THEN** 系统不导航任何代码站点 WebView 到远程页面

#### Scenario: 加载 obra/superpowers 页面

- **WHEN** 归一化仓库为 `obra/superpowers`
- **THEN** Zread 页面加载 `https://zread.ai/obra/superpowers`
- **AND** DeepWiki 页面加载 `https://deepwiki.com/obra/superpowers`
- **AND** CodeWiki 页面加载 `https://codewiki.google/github.com/obra/superpowers`

### Requirement: 代码站点 WebView 受到安全约束

系统 SHALL 仅允许已知代码站点 origin、生成后的仓库路径和匹配持久化 partition 对应的代码站点 WebView。

#### Scenario: 有效代码站点配置

- **WHEN** 代码站点 WebView 使用生成后的代码站点 URL 和配置的 partition attach
- **THEN** attach 被允许

#### Scenario: 无效代码站点配置

- **WHEN** 代码站点 WebView 使用任意 origin、任意路径或不匹配的 partition attach
- **THEN** attach 被阻止
```

